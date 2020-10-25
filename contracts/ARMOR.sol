pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ARMOR is ERC20 {

  constructor() ERC20("ARMOR", "ARMOR") public {
  }

  /// @notice mint `amount` tokens to `account`
  /// @dev only minter can call this function
  /// @param account address to receive minted token
  /// @param amount amount of tokens to be minted
  // TODO: add onlyMinteer
  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }

  /// @notice burn `amount` from msg.sender's balance
  /// @param amount amount fo tokens to be burned
  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }
}
