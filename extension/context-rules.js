globalThis.CONTEXT_DETECTION_RULES = [
    {
        category: "Person Name",
        keywords: [
            "name",
            "student name",
            "full name",
            "father name",
            "father's name",
            "mother name",
            "mother's name",
            "guardian name"
        ],
        relationship: "next-cell-or-container"
    },
    {
        category: "Date of Birth",
        keywords: [
            "date of birth",
            "dob",
            "birth date",
            "birthdate",
            "date of birth no."
        ],
        relationship: "next-element"
    },
    {
        category: "Address",
        keywords: [
            "address",
            "permanent address",
            "present address",
            "correspondence address",
            "residential address",
            "city"
        ],
        relationship: "next-cell-or-container"
    },
    {
        category: "Address Component",
        keywords: [
            "house number",
            "house no.",
            "street",
            "locality",
            "district",
            "state",
            "postal code",
            "pin code",
            "pincode"
        ],
        relationship: "next-cell"
    }
];