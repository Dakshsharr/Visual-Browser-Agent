globalThis.INPUT_DETECTION_RULES = [
    {
        category: "Full Name",
        types: [],
        keywords: [
            "full-name", "fullname", "first-name", "firstname",
            "last-name", "lastname", "middle-name", "middlename",
            "given-name", "family-name", "your-name"
        ]
    },
    {
        category: "Email Address",
        types: ["email"],
        keywords: [
            "email", "e-mail", "mail-address", "emailaddress"
        ]
    },
    {
        category: "Phone Number",
        types: ["tel"],
        keywords: [
            "phone", "mobile", "telephone", "telno",
            "cell", "cellno", "contact-number",
            "phone-number", "mobile-number"
        ]
    },

    {
        category: "Password",
        types: ["password"],
        keywords: [
            "password", "passwd", "pwd", "passcode",
            "login-password", "confirm-password"
        ]
    },
    {
        category: "Username",
        types: [],
        keywords: [
            "username", "user-name", "user-id",
            "login-id", "account-name"
        ]
    },
    {
        category: "Security Answer",
        types: [],
        keywords: [
            "security-answer", "secret-answer",
            "recovery-answer", "mother-maiden"
        ]
    },

    {
        category: "Aadhaar ID",
        types: [],
        keywords: [
            "aadhaar", "aadhar", "aadhaar-number",
            "aadhar-number", "uidai"
        ]
    },
    {
        category: "PAN ID",
        types: [],
        keywords: [
            "pan-number", "pan-card", "permanent-account-number"
        ]
    },
    {
        category: "Passport Number",
        types: [],
        keywords: [
            "passport", "passport-number", "passport-no"
        ]
    },
    {
        category: "Voter ID",
        types: [],
        keywords: [
            "voter-id", "voterid", "epic-number",
            "election-card"
        ]
    },
    {
        category: "Driving Licence",
        types: [],
        keywords: [
            "driving-licence", "driving-license",
            "dl-number", "licence-number", "license-number"
        ]
    },
    {
        category: "Other Government ID",
        types: [],
        keywords: [
            "government-id", "national-id",
            "identity-number", "identity-card"
        ]
    },

    {
        category: "Date of Birth",
        types: [],
        keywords: [
            "dob", "date-of-birth", "birth-date",
            "birthdate", "birthday"
        ]
    },
    {
        category: "Gender",
        types: [],
        keywords: [
            "gender", "sex"
        ]
    },
    {
        category: "Nationality",
        types: [],
        keywords: [
            "nationality", "citizenship"
        ]
    },
    {
        category: "Marital Status",
        types: [],
        keywords: [
            "marital-status", "marriage-status"
        ]
    },

    {
        category: "Home Address",
        types: [],
        keywords: [
            "address", "home-address", "residential-address",
            "street-address", "address-line", "postal-address"
        ]
    },
    {
        category: "PIN / ZIP Code",
        types: [],
        keywords: [
            "pincode", "pin-code", "postal-code",
            "zipcode", "zip-code"
        ]
    },
    {
        category: "Location",
        types: [],
        keywords: [
            "current-location", "geolocation",
            "latitude", "longitude"
        ]
    },

    {
        category: "Credit / Debit Card",
        types: [],
        keywords: [
            "cc-number", "card-number", "credit-card",
            "debit-card", "cardnumber", "payment-card"
        ]
    },
    {
        category: "Card CVV / CVC",
        types: [],
        keywords: [
            "cc-csc", "cvv", "cvc", "security-code",
            "card-verification"
        ]
    },
    {
        category: "Card Expiry Date",
        types: [],
        keywords: [
            "cc-exp", "expiry-date", "expiration-date",
            "card-expiry"
        ]
    },
    {
        category: "Bank Account Number",
        types: [],
        keywords: [
            "account-number", "bank-account",
            "bankaccount", "account-no"
        ]
    },
    {
        category: "IFSC Code",
        types: [],
        keywords: [
            "ifsc", "ifsc-code", "bank-ifsc"
        ]
    },
    {
        category: "UPI ID",
        types: [],
        keywords: [
            "upi", "upi-id", "vpa", "virtual-payment-address"
        ]
    },
    {
        category: "Financial Information",
        types: [],
        keywords: [
            "salary", "income", "annual-income",
            "tax-information", "investment-account"
        ]
    },

    {
        category: "Student ID",
        types: [],
        keywords: [
            "student-id", "studentid", "roll-number",
            "registration-number", "enrollment-number"
        ]
    },
    {
        category: "Employee ID",
        types: [],
        keywords: [
            "employee-id", "employeeid", "staff-id",
            "personnel-number"
        ]
    },
    {
        category: "Education Information",
        types: [],
        keywords: [
            "school-name", "college-name", "university",
            "institution", "degree", "course"
        ]
    },
    {
        category: "Employment Information",
        types: [],
        keywords: [
            "employer", "company-name", "job-title",
            "workplace", "occupation"
        ]
    },

    {
        category: "Medical Information",
        types: [],
        keywords: [
            "medical-record", "medical-history",
            "diagnosis", "condition", "medication",
            "prescription", "blood-group",
            "health-id", "abha"
        ]
    },

    {
        category: "Emergency Contact",
        types: [],
        keywords: [
            "emergency-contact", "emergency-phone",
            "next-of-kin"
        ]
    },
    {
        category: "Family Information",
        types: [],
        keywords: [
            "father-name", "mother-name",
            "guardian-name", "spouse-name"
        ]
    },

    {
        category: "Biometric Information",
        types: [],
        keywords: [
            "fingerprint", "face-id", "facial-recognition",
            "biometric", "voiceprint"
        ]
    },
    {
        category: "APAAR ID",
        types: [],
        keywords: [
            "apaar",
            "abc id",
            "academic bank of credits"
        ]
    }
];

globalThis.TEXT_DETECTION_RULES = [

    {
        category: "Email Address",
        pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
    },

    {
        category: "Indian Phone Number",
        pattern: /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g
    },

    {
        category: "Aadhaar ID",
        pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
    },

    {
        category: "PAN ID",
        pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/gi
    },

    {
        category: "Indian PIN Code",
        pattern: /\b[1-9]\d{5}\b/g
    },

    {
        category: "IFSC Code",
        pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi
    },

    {
        category: "Credit/Debit Card Number",
        pattern: /\b(?:\d[ -]*?){13,19}\b/g
    }

];