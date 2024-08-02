Analyzes controllers of a tsoa app using typescipt compiler api and creates a typescript client taht can consume the tsoa API directly based on the method types instead of the OpenAPI spec. This reduces type footprint since something like `Omit<User, 'gravatarImage'>` does not create a new type `Omit_User._gravatarImage__` but rather keeps the original typing.

# Usage

```
npx @arten/tsoa-client-generator -g /path/to/backend/project/**/*.controller.ts -o ./src/api
```

Searches for all files ending with `.controller.ts` in `/path/to/backend/project/` recursivly and generates services, type definitions and a client in the directory in `./src/api`.
