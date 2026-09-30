(function exposeLabelData(scope) {
  "use strict";

  function destinationWithPhone(destination, phone) {
    const address = String(destination || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
    const number = String(phone || "").replace(/\r?\n/g, " ").trim();
    if (!number) return address;
    if (!address) return `Tél. ${number}`;
    if (address.includes(number)) return address;
    const lines = address.split("\n");
    const last = lines.length - 1;
    lines[last] = `${lines[last]} · Tél. ${number}`;
    return lines.join("\n");
  }

  scope.CheaplyLabelData = Object.freeze({ destinationWithPhone });
})(globalThis);
