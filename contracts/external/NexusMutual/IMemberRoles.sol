// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

interface IMemberRoles {
    function payJoiningFee(address _userAddress) external payable;
    function kycVerdict(address payable _userAddress, bool verdict) external;
}
