# OxView file format
Oxview has a JSON-based file format to save and load designs. An .oxview file is structured in a simple hierarchy, with a main object containing a ``systems`` list together with possible metadata such as simulation box size.

```JSON
{
  "box": [100, 100, 100],
  "systems": []
}
```

Positions are noted in oxDNA units, where 1 distance unit equals 0.8518 nanometers.

## System

Each system needs to contain a unique system index ``id`` and a list of strands.

```JSON
{
  "id": 0,
  "strands": []
}
```

## Strand

The attributes of each strand should be: ``id`` - a unique strand index, ``end3`` - the monomer index of the 3' end of the strand, ``end5`` - the monomer index of the 5' end of the strand, ``class`` - the strand type (currently ``NucleicAcidStrand`` and ``Peptide`` are supported), and ``monomers`` - a list of monomers.

Circular strands should still have ``end3`` and ``end5`` specified, as this will indicate where to start traversal. Just make sure that the monomer with id ``end3`` has an ``n3`` of ``end5`` and the ``end5`` monomer has an ``n5`` of ``end3``.
```JSON
{
  "id": 0,
  "end3": 0,
  "end5": 63,
  "class": "NucleicAcidStrand",
  "monomers": []
}
```

## Monomer

The attributes of each monomer should be: ``id`` - a unique monomer index, ``type`` - the monomer type (e.g. A, T, C, or G if DNA), ``class`` - the monomer type (currently ``DNA``, ``RNA`` and ``AA`` (amino acid) are supported), ``p``: center of mass position (in oxDNA coordinates), ``a1``: backbone vector, and ``a3``: stacking vector. 

Monomers can also include ``n5`` - the monomer index of the 5' neighbor, ``n3`` - the monomer index of the 3' neighbor, ``bp`` - the monomer index of the paired nucleotide (for DNA and RNA), ``cluster`` - index of cluster group that the monomer belongs to, and ``color`` a base 10 representation of a hexadecimal color (used to set custom coloring). 
```JSON
{
  "id": 0, "type": "C", "class": "DNA",
  "p": [0,0,0],
  "a1": [0.8271594,0.5538015,0.0954520],
  "a3": [0,0,1],
  "n3": 63, "n5": 1, "bp": 95,
  "cluster": 1, "color": 3633362
}
```


## Complete example
Listing \ref{lst:oxview_format_example} shows an example of a complete oxview file, describing two base pairs of a DNA helix.

```JSON
{
  "date": "2021-08-23T08:38:04.553Z",
  "box": [10, 10, 10],
  "systems": [{
      "id": 0,
      "strands": [
        {
          "id": 0,
          "monomers": [
            {
              "id": 2,
              "type": "A",
              "class": "DNA",
              "p": [-0.3518234193325043, -0.48602294921875, -0.19488525390625],
              "a1": [0.586372371762991, 0.810089111328125, 0],
              "a3": [0, 0, -1],
              "n3": 0,
              "cluster": 1,
              "color": 16777215,
              "bp": 3
            },
            {
              "id": 0,
              "type": "A",
              "class": "DNA",
              "p": [0, -0.5999755859375, 0.19488525390625],
              "a1": [0, 1, 0],
              "a3": [0, 0, -1],
              "n5": 2,
              "cluster": 2,
              "bp": 1
            }
          ],
          "end3": 0,
          "end5": 2,
          "class": "NucleicAcidStrand"
        },
        {
          "id": 1,
          "monomers": [
            {
              "id": 1,
              "type": "T",
              "class": "DNA",
              "p": [0, 0.5999755859375, 0.19488525390625],
              "a1": [0, -1, 0],
              "a3": [0, 0, 1],
              "n3": 3,
              "cluster": 2,
              "color": 16777215,
              "bp": 0
            },
            {
              "id": 3,
              "type": "T",
              "class": "DNA",
              "p": [0.3518234193325043, 0.48602294921875, -0.19488525390625],
              "a1": [-0.586372371762991, -0.810089111328125, 0],
              "a3": [0, 0, 1],
              "n5": 1,
              "cluster": 1,
              "color": 16711680,
              "bp": 2
            }
          ],
          "end3": 3,
          "end5": 1,
          "class": "NucleicAcidStrand"
        }
      ]
    }
  ]
}
```
