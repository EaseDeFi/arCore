// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

contract RewardManagerMock {
    mapping(address => uint256) public stakes;
    function stake(address _user, uint256 _price, uint256 _nftId) external {
        stakes[_user] += _price;
    }

    function withdraw(address _user, uint256 _amount, uint256 _nftId) external {
        stakes[_user] -= _amount;
    }
}
