pragma solidity ^0.6.6;
contract BalanceManagerMock {
    mapping(address => uint256) balance;
    event PriceChangedMock(address indexed _user, uint256 _price);
    function balanceOf(address _user) external view returns(uint256) {
        return balance[_user];
    }
    function changePrice(address _user, uint256 _price) external {
        emit PriceChangedMock(_user, _price);
    }
    function setBalance(address _user, uint256 _balance) external {
        balance[_user] = _balance;
    }
}
