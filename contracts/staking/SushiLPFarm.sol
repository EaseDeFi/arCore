// SPDX-License-Identifier: MIT


// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;
import '../interfaces/IMasterChef.sol';
import './LPFarm.sol';
/**
 * @title Armor Shield LP - Sushi
 * @dev Vault to allow LPs to gain LP rewards and ARMOR tokens while being protected from hacks with coverage for the protocol.
 * @author Robert M.C. Forster
**/
contract SushiLPFarm is LPFarm {
    IMasterChef public masterChef;

    IERC20 public sushiToken;

    uint256 public pid;

    uint256 public sushiLastUpdateTime;
    uint256 public sushiPeriodFinish;
    uint256 public sushiRewardRate;
    uint256 public sushiRewardPerTokenStored;

    mapping(address => uint256) public sushiRewards;

    mapping(address => uint256) public sushiUserRewardPerTokenPaid;

    event SushiRewardPaid(address account, uint256 reward);
    event SushiRewardAdded(uint256 reward);

    modifier updateSushiReward(address account) {
        sushiRewardPerTokenStored = sushiRewardPerToken();
        sushiLastUpdateTime = sushiLastTimeRewardApplicable();
        notifySushiReward();
        // distribute sushi rewards
        if (account != address(0)) {
            sushiRewards[account] = sushiEarned(account);
            sushiUserRewardPerTokenPaid[account] = sushiRewardPerTokenStored;
        }
        _;
    }
    
    function initialize(uint256 _pid, address _controller, address _masterChef)
      external
    {
        require(address(stakeToken) == address(0), "already initialized");
        (IERC20 _stakeToken, , , ) = IMasterChef(_masterChef).poolInfo(_pid);
        stakeToken = _stakeToken;
        controller = FarmController(_controller);
        sushiToken = IERC20(IMasterChef(_masterChef).sushi());
        rewardToken = controller.rewardToken();
        masterChef = IMasterChef(_masterChef);
        stakeToken.approve(_masterChef, uint256(~0));
    }
    
    function sushiLastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, sushiPeriodFinish);
    }
    
    function sushiRewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return sushiRewardPerTokenStored;
        }
        return
            sushiRewardPerTokenStored.add(
                sushiLastTimeRewardApplicable()
                    .sub(sushiLastUpdateTime)
                    .mul(sushiRewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function sushiEarned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(sushiRewardPerToken().sub(sushiUserRewardPerTokenPaid[account]))
                .div(1e18)
                .add(sushiRewards[account]);
    }

    function stake(uint256 amount) public override updateSushiReward(msg.sender) {
        LPFarm.stake(amount);
        masterChef.deposit(pid, stakeToken.balanceOf(address(this)));
    }

    function withdraw(uint256 amount) public override updateSushiReward(msg.sender) {
        masterChef.withdraw(pid, amount);
        LPFarm.withdraw(amount);
    }

    function exit() external override {
        withdraw(balanceOf(msg.sender));
        getReward();
    }
    
    function getReward() public updateSushiReward(msg.sender) override {
        LPFarm.getReward();
        //get Sushi reward
        uint256 sushiReward = sushiEarned(msg.sender);
        if (sushiReward > 0) {
            sushiRewards[msg.sender] = 0;
            sushiToken.safeTransfer(msg.sender, sushiReward);
            emit SushiRewardPaid(msg.sender, sushiReward);
        }
    }
    
    function notifySushiReward()
        internal
    {
        // this will drip the sushi held in lpfarm to users
        masterChef.withdraw(pid,0);
        uint256 sushiReward = sushiToken.balanceOf(address(this));
        sushiRewardRate = sushiReward.div(DURATION);
        sushiLastUpdateTime = block.timestamp;
        sushiPeriodFinish = block.timestamp.add(DURATION);
    }
}
