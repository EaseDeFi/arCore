// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

contract ClaimManagerMock {
    function mockDeposit() external payable{}
    function exchangeWithdrawal(uint256 _amount) external {
        msg.sender.transfer(_amount);
    }
    function mock() external view returns(address) {
        return msg.sender;
    }
    function transferNft(address to, uint256 id) external {
    }
}
