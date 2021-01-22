// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract ArmorToken is ERC20 {

    constructor() ERC20("Armor", "ARMOR") public {
        _mint( msg.sender, 1000000000 * (10 ** 18) );
    }

}
