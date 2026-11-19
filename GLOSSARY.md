# create-nest-kit

A wizard that generates a NestJS API from a fixed sequence of layers. Every combo of options yields the same modules and the same HTTP contract.

## The installer

**Installer**:
The `create-nest-kit` CLI as a whole.
_Avoid_: Generator, scaffolder

**Wizard**:
The installer's interactive prompts.

**Generated project**:
What the installer produces from one combo.
_Avoid_: App, output, scaffold

**Layer**:
A folder of templates plus a manifest; a combo selects a fixed sequence of layers.
_Avoid_: Plugin, preset, module

**Planned layer**:
A layer that exists but is not offered yet; the wizard shows it as coming soon and the CLI refuses it.

**Manifest**:
A layer's description of the dependencies, scripts, env vars, compose services and README sections it contributes.

**Slot**:
A fixed project path that exactly one layer must provide, through which other layers import variant code.
_Avoid_: Extension point, hook

**Rendered file**:
A project file the installer computes from the merged manifests rather than copying from a template.

**Relocation**:
Mapping a template path to its project path for the chosen options, with imports rewritten to match.
_Avoid_: Transform, move

## Options and combos

**Option**:
Any input the wizard prompts for or the CLI accepts.
_Avoid_: Choice, setting

**Code-shaping option**:
One of the seven options that change the generated code: platform, database, ORM, auth style, validation library, pattern and layout.
_Avoid_: Combo choice

**Combo**:
One value for each code-shaping option; a generated project is built from exactly one combo.
_Avoid_: Combination, variant, flavour

**Matrix**:
Generating a set of combos and running the generated projects' checks in each.
_Avoid_: Combo list

## Generated project structure

**Pattern**:
How a feature module organises its operations: `service` or `cqrs`.

**Layout**:
Where modules sit under `src/` and how imports between them are written: `nested` or `flat`.

**Role folder**:
A folder inside a feature module of a CQRS project that groups files by what they are, such as `commands/handlers`, `providers` or `models`.

**Feature module**:
A module that owns part of the HTTP contract: auth, users, roles, sessions and permissions.

**Infrastructure module**:
A module that provides runtime services rather than domain behaviour: health, logger, mail, queue, redis and throttler.

**Top-level module**:
In a flat project, any folder directly under `src/`; the unit the `@/` import rule is measured against.

**Port**:
The abstract class a feature module owns and depends on for storage.
_Avoid_: Repository port, repository interface

**Repository**:
The ORM-specific class that implements a port.
_Avoid_: Adapter, store

## Guarantees

**HTTP contract**:
The endpoints, status codes and payloads every combo serves identically.
_Avoid_: Contract, API spec

**Contract suite**:
A shared test suite every implementation of a port must pass.
_Avoid_: Contract, contract test
