// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../general/Ownable.sol";
import "../interfaces/IArmorMaster.sol";
import "../general/Keeper.sol";

contract ArmorMaster is Ownable, IArmorMaster {
    mapping(bytes32 => address) internal _modules;

    bytes32[] internal _jobs;

    function initialize() public {
        Ownable.initializeOwnable();
        require(_modules[bytes32("MASTER")] == address(0), "already initialized");
        _modules[bytes32("MASTER")] = address(this);
    }

    function registerModule(bytes32 _key, address _module) external override onlyOwner {
        _modules[_key] = _module;
    }

    function getModule(bytes32 _key) external override view returns(address) {
        return _modules[_key];
    }

    function addJob(bytes32 _key) external onlyOwner {
        require(_jobs.length < 3, "cannot have more than 3 jobs");
        require(_modules[_key] != address(0), "manager is not listed");
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
    }

    function keep() external override {
        for(uint256 i = 0; i < _jobs.length; i++) {
            IKeeperRecipient(_modules[_jobs[i]]).keep();
        }
    }
}
