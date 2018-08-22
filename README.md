# EthSaver

A set of Ethereum Smart Contracts for saving & finance managenment.

## Time Locked 

An Ethereum Smart Contract that allows you to save ETH in it until a timestamp is reached on the blockchain.

### Deposit

Engage the `deposit` function as payable with a timestamp to deposit ETH. You may make further deposits and either increase or keep the existing timestamp. A 0.5% deposit fee is charged.

### Withdrawal

Engage `withdraw` after the timestamp with the same address you deposited with to initiate withdrawal.

## Penalty Box

An Ethereum Smart Contract that allows you to save ETH in it until a timestamp is reached on the blockchain, or allows early withdrawal with a 10% fee.

## Deposit

Engage the `deposit` function as payable with a timestamp to deposit ETH. You may make further deposits and either increase or keep the existing timestamp. No fee is charged.

### Withdrawal

Withdrawal accepts an `allowEarly` boolean to say if the withdrawal is permitted if the timestamp hasn't expired.

#### Withdrawal after expiry

Engage `withdraw` with `false` on the `allowEarly` parameter after the timestamp with the same address you deposited with to initiate withdrawal with no penalty.

#### Withdrawal before expiry

Engage `withdraw` with `true` on the `allowEarly` parameter  with the same address you deposited with to initiate withdrawal with a 10% penalty.
