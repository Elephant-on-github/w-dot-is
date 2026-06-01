w.is is short for who, what or where is x

it should provide an output in the cli with a colour ascii art of the place, person or thing.
next to the art should be a short bio

they should share half the terminal width each
above them should be the full name of the thing searched for

it should use a wikipedia api with a regex matching

if x is a person it should include stuff such as age, date of birth / death, notable works / discoveries, net worth (if applicable), awards (if any), titles (if any)
if x is a place it should say address (whether this be country or more specific), population (if applicable), other notable things about the place, gdp (if a country)
if x is an animal or living thing it should say full species name, and any other relavant info (such as habitat, or location, or endangered status)

this should primarily output in colour with nice formatting, written in ts with correct development tooling / tests.
uses bun. 

it should also have a simple cli for use in other applications that reads like:
w.is --is banana --a fruit or w.is --is saturn --a planet
