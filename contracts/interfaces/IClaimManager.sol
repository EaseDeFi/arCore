// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IClaimManager {
    function initialize(address _armorMaster) external;
    function transferNft(address _to, uint256 _nftId) external;
}
