# Database Seed Data System

This directory contains a database seeding system that populates MongoDB with initial data from JSON
files while properly resolving cross-references between collections.

## Directory Structure

```
seedData/
├── collectionDependencies.ts  # Defines dependencies between collections
├── data/                      # JSON data files for collections
│   ├── answer.json
│   └── collection.json
│   ├── comment.json
│   └── community.json
│   ├── messages.json
│   ├── question.json
│   ├── tag.json
│   └── user.json
├── deleteDB.ts                # Script to clear database
├── populateDB.ts              # Main script to populate database
├── resolvers/                 # Functions to resolve references
│   ├── answer.ts
│   ├── collection.ts
│   ├── helpers.ts
│   ├── identity.ts
│   └── question.ts
└── utils.ts                   # Utility functions
```

## How It Works

### JSON Data Files

The `data/` directory contains JSON files that define the initial data for each collection. Each
entity in these files is structured as:

```json
{
  "temp_key": {
    "property1": "value1",
    "property2": "value2",
    "reference_property": ["temp_key_of_referenced_object"]
  }
}
```

The `temp_key` is a temporary identifier used only within these JSON files to establish
relationships between objects. These temporary keys will be replaced with actual MongoDB ObjectIds
during the database population process. Refer to `data/questions.json` for an example, where the
answers and comments are referred to using these temporary keys.

### Reference Resolution

When an object in one collection references objects in another collection (e.g., a question
referencing answers), these references need to be resolved to actual MongoDB ObjectIds. The system
handles this through:

1. **Resolvers**: Functions in the `resolvers/` directory that identify which properties need
   reference resolution
2. **Dependency Order**: A topological sort of collection dependencies to ensure collections are
   populated in the correct order

### Key Components

#### collectionDependencies.ts

This file defines which collections have dependencies on other collections. It's used to determine
the order in which collections should be populated. **This file must be updated when adding a new
collection.** Any collections not included will not be populated when running the script.

#### resolvers/\*.ts

These files define how to handle reference resolution for each collection:

- `helpers.ts`: Contains the `resolveRefs` helper function used by other resolvers
- `identity.ts`: A simple resolver that returns objects unchanged (for collections without
  references)
- Other resolvers: Collection-specific functions that use `resolveRefs` to transform temporary keys
  into ObjectIds for specific properties

#### populateDB.ts

The main script that:

1. Determines the correct processing order based on dependencies
2. Reads JSON data files
3. Calls the appropriate resolver for each collection
4. Uploads the resolved documents to MongoDB

## Usage

### Environment Setup

Ensure you have the MongoDB connection URI set in your environment:

```
MONGODB_URI=mongodb://localhost:27017
```

The system will populate a database named `fake_so` using this connection.

### Running the Scripts

To clear the database:

```
npm run delete-db
```

To populate the database with seed data:

```
npm run populate-db
```

## Adding New Collections

When adding a new collection:

1. Create a JSON file in the `data/` directory
2. Create a resolver in the `resolvers/` directory (if necessary)
3. Update `collectionDependencies.ts` to include the new collection and its dependencies
4. Update the `collectionMapping` in `populateDB.ts` to call the correct model and resolver for the
   new collection

> **Note:** Make sure that the file name within `data` matches the key names used in
> `collectionDependencies` and for `insertedDocs`. The keys are used to programatically find the
> files in `loadJSON`, and this `collectionName` is used as a key in all locations in the code. If,
> for some reason, an argument throws an error because it's `undefined` while populating, this
> naming should be the first place to look.

## Example

For example, if a question references answers and comments, the dependency graph ensures comments
and answers are populated before questions, allowing the question resolver to correctly replace
temporary keys with actual MongoDB ObjectIds.
