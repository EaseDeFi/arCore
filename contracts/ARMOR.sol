pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ARMOR is ERC20 {

  constructor() ERC20("ARMOR", "ARMOR") public {
  }

  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }

  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }
}
