// SPDX-License-Identifier: MIT



pragma solidity ^0.6.0;

import "../general/Ownable.sol";
import "../interfaces/IERC20.sol";
import "../libraries/SafeMath.sol";

contract Vesting {
    
    using SafeMath for uint256;
    
    IERC20 public token;

    uint256 constant private DENOMINATOR = 10000;

    uint256 public totalTokens;
    uint256 public releaseStart;
    uint256 public releaseEnd;
    uint256 public totalWeight;

    mapping (address => uint256) public starts;
    mapping (address => uint256) public weights;
    mapping (address => uint256) public released;
    mapping (address => uint256) public releasable;

    event Claimed(address indexed _user, uint256 _amount, uint256 _timestamp);
    event Transfer(address indexed _from, address indexed _to, uint256 _percent, uint256 _weight, uint256 _timestamp);

    // do not input same recipient in the _recipients, it will lead to locked token in this contract
    function initialize(
                    address _token, 
                    uint256 _totalTokens, 
                    uint256 _start, 
                    uint256 _period,
                    address[] calldata _recipients, 
                    uint256[] calldata _weights)
      public 
    {
        require(releaseEnd == 0, "Contract is already initialized.");
        require(_recipients.length == _weights.length, "Array lengths do not match.");
        
        releaseEnd = _start.add(_period);
        releaseStart = _start;
        token = IERC20(_token);
        token.transferFrom(msg.sender, address(this), _totalTokens);
        totalTokens = _totalTokens;
        uint256 sum = 0;
        
        for(uint256 i = 0; i<_recipients.length; i++) {
            starts[_recipients[i]] = releaseStart;
            weights[_recipients[i]] = _weights[i];
            sum = sum.add(_weights[i]);
        }
        
        totalWeight = sum;
    }

    function claim()
      public
    {
        address user = msg.sender;
        require(releaseStart <= block.timestamp, "Release has not started");

        uint256 claimAmount = claimableAmount(user);
        released[user] = released[user].add(claimAmount);
        releasable[user] = 0;
        token.transfer(user, claimAmount);
        
        emit Claimed(user, claimAmount, block.timestamp);
    }

    function claimableAmount(address _user) public view returns(uint256) {
        if(block.timestamp < releaseStart) {
            return 0;
        }
        uint256 applicableTimeStamp = block.timestamp >= releaseEnd ? releaseEnd : block.timestamp;
        uint256 totalClaimable = totalTokens * (applicableTimeStamp.sub(starts[_user])) * weights[_user] / (( releaseEnd.sub(releaseStart) ) * totalWeight);
        return totalClaimable.sub(released[_user]).add(releasable[_user]);
    }
    
    /**
     * @dev Transfers a sender's weight to another address starting from now.
     * @param _to The address to transfer weight to.
     * @param _percentInHundredths The percent of your weight to transfer (1000 = 10%).
    **/
    function transfer(address _to, uint256 _percentInHundredths)
      external
    {
        address user = msg.sender;
        require(_to != address(0), "You may not transfer funds to address(0)");
        require(weights[user] > 0 && weights[_to] == 0, "User has no stake or recipient has stake.");
        require(_percentInHundredths <= 10000, "You may not transfer more than 100% of your weight.");
        require(block.timestamp <= releaseEnd && block.timestamp >= releaseStart, "Must only transfer within vesting period.");
        
        // Clear claimable tokens first without transferring out of the contract.
        releasable[user] = claimableAmount(user);
        
        uint256 amount = weights[user].mul(_percentInHundredths).div(DENOMINATOR);
        weights[user] = weights[user].sub(amount);
        weights[_to] = weights[_to].add(amount);
        
        // User must also be reset.
        starts[user] = block.timestamp;
        starts[_to] = block.timestamp;
        released[user] = 0;
        
        emit Transfer(user, _to, _percentInHundredths, amount, block.timestamp);
    }

}