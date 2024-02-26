const hre = require("hardhat");

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = currentTimestampInSeconds + 60;
  const label = "MacBook M3";
  const lockedAmount = hre.ethers.parseEther("0.001");
  const bankAddress = "0xd90a99c6ba6e8fe64e92ed91f6fea9b4894f815c";

  const bank = await hre.ethers.getContractAt("Bank", bankAddress);

  const lock = await bank.lockFunds(unlockTime, label, { value: lockedAmount });

  console.log(` transaction completed`);
  const TRANSACTION_HASH =
    "0x128fdf6372b7b5cf84b0a65087b099ec32de61780216ad940bb39f9a1b3c633f";
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
