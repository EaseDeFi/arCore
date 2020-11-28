pragma solidity ^0.6.6;

contract BalanceManagerMock {
    mapping(address => uint256) balance;
    mapping(address => uint256) price;
    event PriceChangedMock(address indexed _user, uint256 _price);
    function balanceOf(address _user) external view returns(uint256) {
        return balance[_user];
    }
    function perSecondPrice(address _user) external view returns(uint256) {
        return price[_user];
    }

    function updateExpireTime(address _planManager, address _user) external {
        _planManager.call(abi.encodeWithSignature("updateExpireTime(address)", _user));
    }
    function changePrice(address _user, uint256 _price) external {
        price[_user] = _price;
        emit PriceChangedMock(_user, _price);
    }
    function setBalance(address _user, uint256 _balance) external {
        balance[_user] = _balance;
    }
}
