// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.0;

import "../general/Ownable.sol";
import "../interfaces/IArmorMaster.sol";
import "../general/Keeper.sol";

/**
 * @dev ArmorMaster controls all jobs, address, and ownership in the Armor Core system.
 *      It is used when contracts call each other, when contracts restrict functions to
 *      each other, when onlyOwner functionality is needed, and when keeper functions must be run.
 * @author Armor.fi -- Taek Lee
**/
contract ArmorMaster is Ownable, IArmorMaster {
    mapping(bytes32 => address) internal _modules;

    // Keys for different jobs to be run. A job correlates to an address with a keep()
    // function, which is then called to run maintenance functions on the contract.
    bytes32[] internal _jobs;

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
            IKeeperRecipient(_modules[_jobs[i]]).keep();
        }
    }

    function jobs() external view returns(bytes32[] memory) {
        return _jobs;
    }

}
