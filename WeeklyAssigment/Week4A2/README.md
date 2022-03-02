# Introduction to Testing the Transcript Server

Learning Objectives for this activity:
* Practice applying asynchronous programming concepts: promises, async/await
* Have an experience working with the Jest testing framework

## Overview
In the last activity, we looked at creating a client application that chained together multiple asynchronous calls to an API service.
In that activity, you judged the correctness of your implementation by running the client and manually inspecting the output.
 
In this activity, you will write "black box" test cases for that same transcript service.
Your test suite should cover the basic behaviors of the API defined in `client.ts`, as well as the `importGrades` function that is defiend in `examples.ts`.

As we will see next week, this is the simplest kind of test suite to write: we are not looking at the source code of the system that we are testing (the transcript service itself).
These kinds of tests are useful for debugging, and in particular, for ensuring that your assumptions about how the black-box service works are valid assumptions.

As you work on the activity, think about what the limitations of these black box tests might be - we'll discuss different kinds of testing strategies in the next few weeks.

## Getting started
Run `npm install` to download the dependencies for this project, and then open it in your IDE of choice. 
Running `npm test` should show the output below:

```
> transcript-client@3.0.0 test
> jest

 PASS  src/client.spec.ts
  Transcript Manager Service
    Create student
      ✓ should return an ID (91 ms)
    Import grades
      ✓ Should create one record for each of the students in the import (135 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.735 s, estimated 2 s
Ran all test suites.
```

## Writing new tests
Examine the tests that are provided in the `client.spec.ts` file.
We've provided two example tests: one for create student, and one for import grades. 

### Defining the test specifications
The first step in writing a test suite like this is to consider what behaviors you will test.
Start by defining new `test` blocks for behaviors that you think that we should test. Think about what name to give your test: good test names capture the behavior that they are exercising, and provide a hint of what results they are expecting.

### Implementing the tests
Similar to the last activity, interact with the transcript server through the API exposed by `client`, and also through the bulk-import wrapper, `importGrades`.
Be sure to `await` any asynchronous calls.

Think about how each test will check for correctness. Consult the [Jest 'Using Matchers' Guide](https://jestjs.io/docs/using-matchers) for a complete listing of all of the `expect` methods that are provided.

### Reflection
As you write your tests, think about the following potential problems, which we'll discuss in greater detail in the coming weeks:
* What if someone else's test runs on the server at the same time as yours?
* What if there is behavior that we need to test in the server that you can not easily observe through the API calls?
* How can we structure these tests to avoid repeated code?