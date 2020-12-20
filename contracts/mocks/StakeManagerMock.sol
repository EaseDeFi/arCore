// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;
import "../interfaces/IPlanManager.sol";

contract StakeManagerMock {
    mapping(address => uint256) limit;

    address planManager;

    event Keep();

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
