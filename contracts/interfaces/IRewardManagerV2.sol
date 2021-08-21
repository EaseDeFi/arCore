// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IRewardManagerV2 {
    function initialize(address _armorMaster, uint256 _rewardCycleBlocks)
        external;

    function deposit(
        address _user,
        address _protocol,
        uint256 _amount,
        uint256 _nftId
    ) external;

    function withdraw(
        address _user,
        address _protocol,
        uint256 _amount,
        uint256 _nftId
    ) external;

    function updateAllocPoint(address _protocol, uint256 _allocPoint) external;

    function initPool(address _protocol) external;

    function notifyRewardAmount() external payable;
}
