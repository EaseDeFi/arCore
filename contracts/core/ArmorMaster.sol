// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

import "../general/Ownable.sol";
import "../interfaces/IArmorMaster.sol";
import "../general/Keeper.sol";
import "../external/Keep3r/Keep3rV1.sol";

/**
 * @dev ArmorMaster controls all jobs, address, and ownership in the Armor Core system.
 *      It is used when contracts call each other, when contracts restrict functions to
 *      each other, when onlyOwner functionality is needed, and when keeper functions must be run.
 * @author Armor.fi -- Taek Lee
**/
contract ArmorMaster is Ownable, IArmorMaster {
    Keep3rV1 public constant KEEP3R = Keep3rV1(0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44);

    mapping(bytes32 => address) internal _modules;

    // Keys for different jobs to be run. A job correlates to an address with a keep()
    // function, which is then called to run maintenance functions on the contract.
    bytes32[] internal _jobs;

    modifier upkeep() {
        uint _gasUsed = gasleft();
        require(KEEP3R.keepers(msg.sender), "!K");
        _;
        uint _received = KEEP3R.KPRH().getQuoteLimit(_gasUsed - gasleft());
        KEEP3R.receipt(address(KEEP3R), msg.sender, _received);
    }


    function initialize() external {
        Ownable.initializeOwnable();
        _modules[bytes32("MASTER")] = address(this);
    }

    /**
     * @dev Register a contract address with corresponding job key.
     * @param _key The key that will point a job to an address.
    **/
    function registerModule(bytes32 _key, address _module) external override onlyOwner {
        _modules[_key] = _module;
    }

    function getModule(bytes32 _key) external override view returns(address) {
        return _modules[_key];
    }

    /**
     * @dev Add a new job that correlates to a registered module.
     * @param _key Key of the job used to point to module.
    **/
    function addJob(bytes32 _key) external onlyOwner {
        require(_jobs.length < 3, "cannot have more than 3 jobs");
        require(_modules[_key] != address(0), "module is not listed");
        for(uint256 i = 0; i< _jobs.length; i++){
            require(_jobs[i] != _key, "already registered");
        }
        _jobs.push(_key);
    }

    function deleteJob(bytes32 _key) external onlyOwner {
        for(uint256 i = 0; i < _jobs.length; i++) {
            if(_jobs[i] == _key) {
                _jobs[i] = _jobs[_jobs.length - 1];
                _jobs.pop();
                return;
            }
        }
        revert("job not found");
    }

    /**
     * @dev Anyone can call keep to run jobs in this system that need to be periodically done.
     *      To begin with, these jobs including expiring plans and expiring NFTs.
    **/
    function keep() external override {
        for(uint256 i = 0; i < _jobs.length; i++) {
            IKeeperRecipient(_modules[_jobs[i]]).keep(1);
        }
    }

    function keep(uint256 _length) external {
        for(uint256 i = 0; i < _jobs.length; i++){
            IKeeperRecipient(_modules[_jobs[i]]).keep(_length);
        }
    }

    function work(uint256[] calldata _jobIds, uint256[] calldata _keepRounds) external upkeep{
        for(uint256 i = 0; i < _jobIds.length; i++) {
            IKeeperRecipient(_modules[_jobs[_jobIds[i]]]).keep(_keepRounds[i]);
        }
    }

    function jobs() external view returns(bytes32[] memory) {
        return _jobs;
    }

}
