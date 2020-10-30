pragma solidity ^0.6.6;

interface IStakeManager {
    function initialize(address _arNFT, address _rewardManager, address _planManager, address _claimManager) external;
    function allowedCover(address _newProtocol, uint256 _newTotalCover) external returns (bool);
}