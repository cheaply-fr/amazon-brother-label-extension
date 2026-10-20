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

  function withTimeout(promise, timeoutMs, message) {
    const timeout = Number(timeoutMs);
    if (!Number.isFinite(timeout) || timeout <= 0) return Promise.resolve(promise);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeout);
      Promise.resolve(promise).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); }
      );
    });
  }

  scope.CheaplyLabelData = Object.freeze({ destinationWithPhone, withTimeout });
})(globalThis);
