// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import "./SushiLPFarm.sol";
import "../general/Ownable.sol";
import "../interfaces/IRewardDistributionRecipientTokenOnly.sol";
import "../interfaces/IERC20.sol";
import "../general/SafeERC20.sol";

contract SushiFarmController is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IRewardDistributionRecipientTokenOnly[] public farms;
    mapping(address => address) public lpFarm;
    mapping(address => uint256) public rate;
    uint256 public weightSum;
    IERC20 public rewardToken;

    mapping(address => bool) public blackListed;

    function initialize(address token) external {
        Ownable.initializeOwnable();
        rewardToken = IERC20(token);
    }

    function addFarm(address _masterChef, uint256 _pid) external onlyOwner returns(address farm){
        (IERC20 lptoken , , ,) = IMasterChef(_masterChef).poolInfo(_pid);
        require(lpFarm[address(lptoken)] == address(0), "farm exist");
        bytes memory bytecode = type(SushiLPFarm).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(address(lptoken)));
        assembly {
            farm := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        SushiLPFarm(farm).initialize(_pid, address(this), _masterChef);
        farms.push(IRewardDistributionRecipientTokenOnly(farm));
        rewardToken.approve(farm, uint256(-1));
        lpFarm[address(lptoken)] = farm;
        // it will just set the rates to zero before it get's it's own rate
    }

    function setRates(uint256[] memory _rates) external onlyOwner {
        require(_rates.length == farms.length);
        uint256 sum = 0;
        for(uint256 i = 0; i<_rates.length; i++){
            sum += _rates[i];
            rate[address(farms[i])] = _rates[i];
        }
        weightSum = sum;
    }

    function setRateOf(address _farm, uint256 _rate) external onlyOwner {
        weightSum -= rate[_farm];
        weightSum += _rate;
        rate[_farm] = _rate;
    }

    function notifyRewards(uint256 amount) external onlyOwner {
        rewardToken.transferFrom(msg.sender, address(this), amount);
        for(uint256 i = 0; i<farms.length; i++){
            IRewardDistributionRecipientTokenOnly farm = farms[i];
            farm.notifyRewardAmount(amount.mul(rate[address(farm)]).div(weightSum));
        }
    }

    // should transfer rewardToken prior to calling this contract
    // this is implemented to take care of the out-of-gas situation
    function notifyRewardsPartial(uint256 amount, uint256 from, uint256 to) external onlyOwner {
        require(from < to, "from should be smaller than to");
        require(to <= farms.length, "to should be smaller or equal to farms.length");
        for(uint256 i = from; i < to; i++){
            IRewardDistributionRecipientTokenOnly farm = farms[i];
            farm.notifyRewardAmount(amount.mul(rate[address(farm)]).div(weightSum));
        }
    }

    function blockUser(address target) external onlyOwner {
        blackListed[target] = true;
    }

    function unblockUser(address target) external onlyOwner {
        blackListed[target] = false;
    }
}
