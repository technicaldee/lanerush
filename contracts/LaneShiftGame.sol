// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title Lane Shift — stake cUSD or CELO to play; owner pays winners from contract balance
contract LaneShiftGame {
    IERC20 public immutable cUSD;
    address public owner;
    address public platform;

    uint256 public constant STAKE = 1e16; // 0.01 cUSD (18 decimals)
    uint256 public constant WIN_PAYOUT = 2e16; // 0.02 cUSD
    uint256 public constant STAKE_CELO = 119980000000000000; // 0.11998 CELO
    uint256 public constant WIN_PAYOUT_CELO = 239960000000000000; // 0.23996 CELO

    uint256 public nextStakeId;
    mapping(uint256 => address) public stakePlayer;
    mapping(uint256 => uint8) public stakeCurrency; // 0 = cUSD, 1 = CELO
    mapping(uint256 => bool) public paidOut;

    event Staked(address indexed player, uint256 indexed stakeId, uint256 timestamp);
    event WinnerPaid(address indexed player, uint256 indexed stakeId, uint256 amount, uint256 timestamp);
    event Swept(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error TransferFailed();
    error AlreadyPaid();
    error NoStake();
    error OnlyOwner();
    error InvalidStakeAmount();
    error NativeTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _cUSD, address _platform) {
        cUSD = IERC20(_cUSD);
        platform = _platform;
        owner = msg.sender;
    }

    /// @notice Pull 0.01 cUSD from player into this contract (losers' funds stay until swept to platform)
    function stakeAndPlay() external returns (uint256 stakeId) {
        stakeId = _stakeCUSD();
    }

    /// @notice Alias for explicit cUSD staking.
    function stakeAndPlayCUSD() external returns (uint256 stakeId) {
        stakeId = _stakeCUSD();
    }

    /// @notice Stake with native CELO.
    function stakeAndPlayCELO() external payable returns (uint256 stakeId) {
        if (msg.value != STAKE_CELO) revert InvalidStakeAmount();
        stakeId = nextStakeId++;
        stakePlayer[stakeId] = msg.sender;
        stakeCurrency[stakeId] = 1;
        emit Staked(msg.sender, stakeId, block.timestamp);
    }

    function _stakeCUSD() internal returns (uint256 stakeId) {
        stakeId = nextStakeId++;
        stakePlayer[stakeId] = msg.sender;
        stakeCurrency[stakeId] = 0;
        if (!cUSD.transferFrom(msg.sender, address(this), STAKE)) revert TransferFailed();
        emit Staked(msg.sender, stakeId, block.timestamp);
    }

    /// @notice Owner pays winner based on original stake currency.
    function payoutWinner(uint256 stakeId) external onlyOwner {
        if (paidOut[stakeId]) revert AlreadyPaid();
        address player = stakePlayer[stakeId];
        if (player == address(0)) revert NoStake();
        paidOut[stakeId] = true;
        uint8 currency = stakeCurrency[stakeId];
        if (currency == 0) {
            if (!cUSD.transfer(player, WIN_PAYOUT)) revert TransferFailed();
            emit WinnerPaid(player, stakeId, WIN_PAYOUT, block.timestamp);
            return;
        }
        (bool ok, ) = payable(player).call{value: WIN_PAYOUT_CELO}("");
        if (!ok) revert NativeTransferFailed();
        emit WinnerPaid(player, stakeId, WIN_PAYOUT_CELO, block.timestamp);
    }

    /// @notice Move accumulated stakes (losses) to platform wallet (both cUSD and CELO)
    function sweepToPlatform() external onlyOwner {
        uint256 cUSDBal = cUSD.balanceOf(address(this));
        if (cUSDBal > 0) {
            if (!cUSD.transfer(platform, cUSDBal)) revert TransferFailed();
            emit Swept(platform, cUSDBal);
        }

        uint256 nativeBal = address(this).balance;
        if (nativeBal > 0) {
            (bool ok, ) = payable(platform).call{value: nativeBal}("");
            if (!ok) revert NativeTransferFailed();
            emit Swept(platform, nativeBal);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    receive() external payable {}
}
