// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import "../general/Ownable.sol";
import "../interfaces/IRewardDistributionRecipientTokenOnly.sol";
import "../interfaces/IERC20.sol";
import "../general/SafeERC20.sol";

contract RewardNotifier is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IRewardDistributionRecipientTokenOnly[] public farms;
    mapping(address => uint256) public rate;
    uint256 public constant DENOMINATOR = 100000;
    IERC20 public rewardToken;

    constructor(address token) public {
        Ownable.initializeOwnable();
        rewardToken = IERC20(rewardToken);
    }

    function addFarm(address _farm) external onlyOwner {
        require(rate[_farm] == 0, "already registerd farm");
        farms.push(IRewardDistributionRecipientTokenOnly(_farm));
        rewardToken.approve(_farm, uint256(-1));
        // it will just set the rates to zero before it get's it's own rate
    }

    function setRates(uint256[] memory _rates) external onlyOwner {
        require(_rates.length == farms.length);
        uint256 sum = 0;
        for(uint256 i = 0; i<_rates.length; i++){
            sum += _rates[i];
            rate[address(farms[i])] = _rates[i];
        }
        require(sum == DENOMINATOR, "sum should be 100%");
    }

    function notify(uint256 amount) external onlyOwner {
        for(uint256 i = 0; i<farms.length; i++){
            IRewardDistributionRecipientTokenOnly farm = farms[i];
            farm.notifyRewardAmount(amount.mul(rate[address(farm)]).div(DENOMINATOR));
        }
    }
}
