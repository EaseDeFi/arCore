// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;
import "../interfaces/IPlanManager.sol";

contract StakeManagerMock {
    mapping(address => uint256) limit;

    address planManager;

    event Keep();

    mapping(address => uint64) public protocolId;
    mapping(uint64 => address) public protocolAddress;

    uint64 protocolCount;
    mapping(address => bool) public allowedProtocol;

    function allowProtocol(address _protocol, bool _allow) external {
        if(protocolId[_protocol] == 0){
            protocolId[_protocol] = ++protocolCount;
            protocolAddress[protocolCount] = _protocol;
        }
        allowedProtocol[_protocol] = _allow;
    }

    function allowedCover(address _protocol, uint256 _total) external view returns (bool) {
        return limit[_protocol] >= _total;
    }

    function mockLimitSetter(address _protocol, uint256 _limit) external {
        limit[_protocol] = _limit;
    }

    function mockSetPlanManager(address _planManager) external {
        planManager = _planManager;
    }

    function mockSetPlanManagerPrice(address _protocol, uint256 _newPrice) external {
        IPlanManager(planManager).changePrice(_protocol, _newPrice);
    }

    function keep() external {
        emit Keep();
    }
}
