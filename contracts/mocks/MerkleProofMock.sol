// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../libraries/MerkleProof.sol";
import "hardhat/console.sol";
contract MerkleProofMock {
  function calculateRoot(bytes32[] memory leaves) external pure returns(bytes32) {
    return MerkleProof.calculateRoot(leaves);
  }
  /**
   * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
   * defined by `root`. For this, a `proof` must be provided, containing
   * sibling hashes on the branch from the leaf to the root of the tree. Each
   * pair of leaves and each pair of pre-images are assumed to be sorted.
   */
  function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) external view returns (bool) {
    return MerkleProof.verify(proof, root, leaf);
  }
}
