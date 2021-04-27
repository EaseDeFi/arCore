// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../general/ArmorModule.sol";

contract ArmorModuleMock is ArmorModule {
    uint256 public counter;

    constructor(address _armorMaster) public {
        initializeModule(_armorMaster);
    }

    function keep(uint256 length) external {
        counter++;
    }
}
