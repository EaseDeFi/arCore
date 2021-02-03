// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

/**
 * @dev Quick interface for the Nexus Mutual contract to work with the Armor Contracts.
 **/

// to get nexus mutual contract address
interface INXMMaster {
    function tokenAddress() external view returns(address);
    function owner() external view returns(address);
    function pauseTime() external view returns(uint);
    function masterInitialized() external view returns(bool);
    function isPause() external view returns(bool check);
    function isMember(address _add) external view returns(bool);
    function getLatestAddress(bytes2 _contractName) external view returns(address payable contractAddress);
}

interface INXMPool {
    function buyNXM(uint minTokensOut) external payable;
}
