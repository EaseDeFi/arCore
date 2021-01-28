// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../libraries/Address.sol";

contract AddressImpl {
    string public sharedAnswer;

    event CallReturnValue(string data);

    function isContract(address account) external view returns (bool) {
        return Address.isContract(account);
    }

    function sendValue(address payable receiver, uint256 amount) external {
        Address.sendValue(receiver, amount);
    }

    function deposit() external payable {
    }
    // sendValue's tests require the contract to hold Ether
    receive () external payable { }
}
