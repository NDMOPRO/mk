/**
 * Common Passwords Blacklist
 * SEC-7: Top 200 most common passwords. Passwords matching this list are rejected.
 * Source: Various public breach compilations.
 */
export const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "1234567890", "qwerty", "abc123", "monkey",
  "master", "dragon", "111111", "baseball", "iloveyou", "trustno1", "sunshine",
  "princess", "football", "charlie", "access", "shadow", "michael", "letmein",
  "superman", "696969", "123123", "batman", "1234567", "password1", "Password1",
  "password123", "Password123", "admin", "admin123", "root", "toor", "pass",
  "test", "guest", "qwerty123", "welcome", "welcome1", "p@ssw0rd", "passw0rd",
  "123456789", "12345", "1234", "login", "starwars", "solo", "qwertyuiop",
  "ashley", "bailey", "passpass", "hello", "charlie", "donald", "loveme",
  "soccer", "hockey", "ranger", "buster", "andrea", "joshua", "thomas",
  "robert", "jordan", "daniel", "hannah", "jessica", "harley", "whatever",
  "nicole", "hunter", "amanda", "summer", "1q2w3e4r", "qazwsx", "zaq1zaq1",
  "computer", "internet", "samsung", "pepper", "1111", "555555", "666666",
  "777777", "888888", "999999", "000000", "121212", "654321", "abcdef",
  "abcabc", "abc123", "a1b2c3", "aaaaaa", "qweasd", "1qaz2wsx", "1q2w3e",
  "zxcvbn", "zxcvbnm", "asdfgh", "asdfghjkl", "pokemon", "matrix", "killer",
  "trustno1", "george", "alexander", "cookie", "creative", "flower", "rainbow",
  "secret", "angel", "friends", "elizabeth", "diamond", "freedom", "thunder",
  "ginger", "hammer", "silver", "222222", "333333", "444444", "987654321",
  "qwer1234", "asdf1234", "zxcv1234", "1234qwer", "1234asdf", "password!",
  "changeme", "changeme1", "Pa$$w0rd", "P@ssword", "P@ssword1", "Passw0rd!",
  "Welcome1", "Welcome1!", "Qwerty123", "Abc12345", "Test1234", "Admin123",
  "User1234", "Temp1234", "Spring2024", "Summer2024", "Winter2024", "Fall2024",
  "Spring2025", "Summer2025", "Winter2025", "Fall2025", "Spring2026", "Summer2026",
  "January1", "February1", "March2026", "April2026", "Company1", "Company123",
  "Monkey123", "Dragon123", "Shadow123", "Master123", "Letmein1", "Trustno1!",
  "Baseball1", "Football1", "Superman1", "Batman123", "Iloveyou1",
]);
