import {formatToFullSimpleType, formatToFullType, hasSimpleStruct} from "../../src/utils/parse";
import {expect} from "chai";

describe("formatToFullType", () => {
  // it("simple", () => {
  //   console.log("simple");
  //   console.log(formatToFullType("0x1::aptos_coin::AptosCoin"));
  //   expect(formatToFullType("0x1::aptos_coin::AptosCoin")).to.be
  //     .eq("0x0000000000000000000000000000000000000000000000000000000000000001::aptos_coin::AptosCoin");
  //   console.log("end simple");
  // });
  //
  // it("compound", () => {
  //   expect(formatToFullType(
  //     "0x5a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP<0xf22bede237a07e121b" +
  //     "56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC, 0x1::aptos_coin::AptosCoin, 0x190d44266241744264" +
  //     "b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::curves::Uncorrelated>"
  //   )).to.be.eq(
  //     "0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP<0xf22bede237a07e121b" +
  //     "56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC, 0x0000000000000000000000000000000000000000000000" +
  //     "000000000000000001::aptos_coin::AptosCoin, 0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12" +
  //     "::curves::Uncorrelated>"
  //   );
  // });

  it("nested", () => {
    expect(formatToFullType(
      "0x4::some_struct::Struct<0x5::struct::Struct, 0x6::struct::Struct<0x7::struct:" +
      ":Struct, 0x8::struct::Struct>>"
    )).to.be.eq(
      "0x0000000000000000000000000000000000000000000000000000000000000004::some_struct::Struct<" +
      "0x0000000000000000000000000000000000000000000000000000000000000005::struct::Struct, " +
      "0x0000000000000000000000000000000000000000000000000000000000000006::struct::Struct<" +
      "0x0000000000000000000000000000000000000000000000000000000000000007::struct::Struct, " +
      "0x0000000000000000000000000000000000000000000000000000000000000008::struct::Struct>>"
    );
    expect(formatToFullType(
      "0x1234::mod::struct<0x1::xxh::vector<0x1::st::a>>"
    )).to.be.eq(
      "0x0000000000000000000000000000000000000000000000000000000000001234::mod::struct<0x00000000000000000000000" +
      "00000000000000000000000000000000000000001::xxh::vector<0x0000000000000000000000000000000000000000000000000000000" +
      "000000001::st::a>>"
    );
    expect(formatToFullType(
      "0x1::a::b<0x1::a::b<vector<0x1::a::b>>,0x1::a::b<u8,u64>>"
    )).to.be.eq(
      "0x0000000000000000000000000000000000000000000000000000000000000001::a::b<" +
      "0x0000000000000000000000000000000000000000000000000000000000000001::a::b<vector<" +
      "0x0000000000000000000000000000000000000000000000000000000000000001::a::b>>," +
      "0x0000000000000000000000000000000000000000000000000000000000000001::a::b<u8,u64>>");
    expect(formatToFullType(
      "vector<0x1::a::b<u8>>"
    )).to.be.eq(
      "vector<0x0000000000000000000000000000000000000000000000000000000000000001::a::b<u8>>"
    );
  });

});
//
// describe("formatToFullSimpleType", () => {
//   it("valid type", () => {
//     const tests = [
//       {
//         raw: "0x1::aptos_coin::AptosCoin",
//         exp: "0x0000000000000000000000000000000000000000000000000000000000000001::aptos_coin::AptosCoin"
//       }, {
//         raw: "0x5a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP",
//         exp: "0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP"
//       }
//     ];
//     for (const test of tests) {
//       const res = formatToFullSimpleType(test.raw);
//       expect(res).to.be.eq(test.exp);
//     }
//   });
// });
//
// describe("isSimpleStruct", () => {
//   it("positive", () => {
//     const tests = [
//       "0x1::aptos_coin::AptosCoin",
//       "0x5a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948::lp_coin::LP",
//     ];
//     for (const test of tests) {
//       expect(isSimpleStruct(test)).to.be.true;
//     }
//   });
//
//   it("negative", () => {
//     const tests = [
//       "0x1::aptos_coin:,:AptosCoin",
//       "0x1g::aptos_coin::AptosCoin",
//       "0x1:::aptos_coin::AptosCoin",
//     ];
//     for (const test of tests) {
//       expect(isSimpleStruct(test)).to.be.false;
//     }
//   });
// });