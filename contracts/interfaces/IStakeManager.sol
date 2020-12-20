// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IStakeManager {
    function initialize(address _armorMaster) external;
    function allowedCover(address _newProtocol, uint256 _newTotalCover) external view returns (bool);
    function subtractTotal(uint256 _nftId, address _protocol, uint256 _subtractAmount) external;
}
