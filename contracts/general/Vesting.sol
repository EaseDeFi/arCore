// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./Ownable.sol";
import "../interfaces/IERC20.sol";

contract Vesting {
    IERC20 public token;

    uint256 public totalTokens;

    uint256 public releaseStart;

    uint256 public releaseEnd;

    uint256 public totalWeight;

    mapping(address => uint256) public weight;

    mapping(address => uint256) public released;

    // do not input same recipient in the _recipients, it will lead to locked token in this contract
    function initialize(address _token, uint256 _totalTokens, uint256 _start, uint256 _period, address[] memory _recipients, uint256[] memory _weights) public {
        require(releaseStart == 0, "already initialized");
        require(_recipients.length == _weights.length, "array length diff");
        releaseStart = _start;
        releaseEnd = _start + _period;
        token = IERC20(_token);
        token.transferFrom(msg.sender, address(this), _totalTokens);
        totalTokens = _totalTokens;
        uint256 sum = 0;
        for(uint256 i = 0; i<_recipients.length; i++){
            weight[_recipients[i]] = _weights[i];
            sum += _weights[i];
        }
        totalWeight = sum;
    }

    function claim() external {
        require(releaseStart <= block.timestamp, "relase not started");
        uint256 claimAmount = claimableAmount(msg.sender);
        released[msg.sender] += claimAmount;
        token.transfer(msg.sender, claimAmount);
    }

    function claimableAmount(address _user) public view returns(uint256) {
        if(block.timestamp < releaseStart) {
            return 0;
        }
        uint256 applicableTimeStamp = block.timestamp >= releaseEnd ? releaseEnd : block.timestamp;
        uint256 totalClaimable = totalTokens * (applicableTimeStamp - releaseStart) * weight[_user] / (( releaseEnd - releaseStart ) * totalWeight);
        return totalClaimable - released[_user];
    }
}
