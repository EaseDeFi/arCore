pragma solidity ^0.6.6;

interface IarNFT {
    
    function getToken(uint256 _tokenId) external returns (uint256, uint8, uint256, uint16, uint256, address, bytes4, uint256, uint256, uint256);
    function submitClaim(uint256 _tokenId) external;
    function redeemClaim(uint256 _tokenId) external;
    
}