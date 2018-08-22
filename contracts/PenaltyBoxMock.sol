pragma solidity ^0.4.24;

import "./PenaltyBox.sol";

contract PenaltyBoxMock is PenaltyBox {

    uint mockNow;
    // Unit tests need to control the time so this simply returns now in a real contract and a mock time in a test
    function getNow() internal view returns(uint) {
        if(mockNow == 0) {
            return now;
        }
        return mockNow;
    }

    function setNow(uint newNow) public {
        mockNow = newNow;
    }
}
