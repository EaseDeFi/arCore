// SPDX-License-Identifier: MIT

pragma solidity =0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

contract MerkleDistributor {
    address public immutable token;
    bytes32 public immutable merkleRoot;
    uint256 public immutable startAt;
    uint256 public immutable rewardRate;

    // This is a packed array of booleans.
    mapping(address => bool) private registered;
    mapping(address => uint256) private lastRewarded;

    constructor(address token_, bytes32 merkleRoot_, uint256 startAt_, uint256 rewardRate_) public {
        token = token_;
        merkleRoot = merkleRoot_;
        startAt = startAt_;
        rewardRate = rewardRate_;
    }

    function isRegistered(address user) public view returns (bool) {
        return registered[user];
    }

    function _setRegistered(address user) private {
        registered[user] = true;
    }

    function claim(address account, bytes32[] calldata merkleProof) external {
        require(!isRegistered(account), 'MerkleDistributor: already registered.');

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(account));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), 'MerkleDistributor: Invalid proof.');

        // Mark it claimed and send the token.
        _setRegistered(account);
        getReward(account);
    }

    function getReward(address account) public {
        require(isRegistered(account), 'MerkleDistributor: should be registered.');
        uint256 lastRewardedTimestamp = lastRewarded[account] == 0 ? startAt : lastRewarded[account];
        uint256 amount = (block.timestamp - lastRewardedTimestamp) * rewardRate;
        lastRewarded[account] = block.timestamp;
        require(IERC20(token).transfer(account, amount), 'MerkleDistributor: Transfer failed.');
    }
}
