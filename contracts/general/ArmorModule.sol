// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../interfaces/IArmorMaster.sol";
import "../general/Ownable.sol";
contract ArmorModule {
    IArmorMaster internal _master;

    modifier onlyOwner() {
        require(msg.sender == Ownable(address(_master)).owner(), "only owner can call this function");
        _;
    }

    modifier doKeep() {
        _master.keep();
        _;
    }

    modifier onlyModule(bytes32 _module) {
        require(msg.sender == getModule(_module), "only module can call this function");
        _;
    }

    function initializeModule(address _armorMaster) internal {
        require(address(_master) == address(0), "already initialized");
        require(_armorMaster != address(0), "master cannot be zero address");
        _master = IArmorMaster(_armorMaster);
    }

    function changeMaster(address _newMaster) external onlyOwner {
        _master = IArmorMaster(_newMaster);
    }

    function getModule(bytes32 _key) internal view returns(address) {
        return _master.getModule(_key);
    }
}
