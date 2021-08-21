// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import "../interfaces/IBalanceManager.sol";
import "../interfaces/IRewardManagerV2.sol";

contract PlanManagerMock {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public totalUsedCover;

    bool coverage;
    event UpdateExpireTime(address _user);

    receive() external payable {}

    function updateExpireTime(address _user, uint256 expiry) external {
        emit UpdateExpireTime(_user);
    }

    function mockChangePrice(
        address _balanceManager,
        address _user,
        uint64 _newPrice
    ) external {
        IBalanceManager(_balanceManager).changePrice(_user, _newPrice);
    }

    function changePrice(address _contract, uint256 _newPrice) external {
        prices[_contract] = _newPrice;
    }

    function mockCoverage(bool _coverage) external {
        coverage = _coverage;
    }

    function checkCoverage(
        address _user,
        address _sc,
        uint256 _time,
        uint256 _amount
    ) external view returns (uint256 index, bool check) {
        return (0, coverage);
    }

    function setTotalUsedCover(address _scAddress, uint256 _cover) external {
        totalUsedCover[_scAddress] = _cover;
    }

    function updateAllocPoint(address _rewardManager, address _protocol)
        external
    {
        IRewardManagerV2(_rewardManager).updateAllocPoint(
            _protocol,
            totalUsedCover[_protocol]
        );
    }
}
