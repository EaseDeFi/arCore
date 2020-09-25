pragma solidity ^0.6.6;

/**
 * @dev Quick interface for the Nexus Mutual contract to work with the Armor Contracts.
**/

interface INexusMutual {
    function submitClaim(uint256 _nftId) external;
    function redeemClaim(uint256 _nftId) external;
}