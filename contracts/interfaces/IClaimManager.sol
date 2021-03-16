// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

interface IClaimManager {
    function initialize(address _armorMaster) external;
    function transferNft(address _to, uint256 _nftId) external;
    function exchangeWithdrawal(uint256 _amount) external;
    function redeemClaim(address _protocol, uint256 _hackTime, uint256 _amount) external;
}
