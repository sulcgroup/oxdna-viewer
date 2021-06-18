var relax_scenarios = {
    "MC":{
        "const":{
            "sim_type"               : {"val":"MC"},
            "backend"                : {"val":"CPU"},
            "ensemble"               : {"val":"NVT"},
            "verlet_skin"            : {"val":1.0},
            "time_scale"             : {"val":"linear"},
            "restart_step_counter"   : {"val":1.0},
            "backend_precision"      : {"val":"double"},
            "use_average_seq"        : {"val":0}
        },
        "relax":{
            "max_backbone_force"   : {
                "val":5,
                "id" : "mcBackboneForce"
            },
            "max_backbone_force_far"   : {
                "val":10,
                "id" : "mcBackboneForceFar"
            }
        },
        "var":{
            "T"                    : {
                                        "val":30,
                                        "id" :"mcT"
                                    },
            "steps"                : {
                                        "val":100000,
                                        "id" :"mcSteps"
                                    },
            "salt_concentration"   : {
                                        "val":1,
                                        "id" : "mcSalt"
                                    },
            "interaction_type"     : {
                                        "val":"DNA2",
                                        "id" : "mcInteractionType"
                                    },
            "print_conf_interval"  : {
                                        "val":50000,
                                        "id" : "mcPrintConfInterval"
                                    },
            "print_energy_every"   : {
                                        "val":50000,
                                        "id" : "mcPrintEnergyInterval"
                                    },

            "delta_translation"    : {
                                        "val":0.22,
                                        "id" : "mcDeltaTranslation"
                                    },
            "delta_rotation"       : {
                                        "val":0.22,
                                        "id" : "mcDeltaRotation"
                                    }
        }
    },
    "MD_GPU" : {
        "const":{
            "sim_type" : {"val":"MD"},
            "T_units":   {"val":"C"},
            "backend" :  {"val":"CUDA"},
            "backend_precision" : {"val":"mixed"},
            "time_scale" : {"val":"linear"},
            "verlet_skin" : {"val":0.5},
            "use_average_seq" : {"val":0},
            "refresh_vel" : {"val":1},
            "CUDA_list" : {"val":"verlet"},
            "restart_step_counter" : {"val":1},
            "newtonian_steps" : {"val":103},
            "CUDA_sort_every" : {"val":0},
            "use_edge" : {"val":1},
            "edge_n_forces" : {"val":1},
            "cells_auto_optimisation" : {"val":"true"},
            "reset_com_momentum" : {"val":"true"}
        },
        "relax":{
            "max_backbone_force"   : {
                "val":5,
                "id" : "mdBackboneForce"
            },
            "max_backbone_force_far"   : {
                "val":10,
                "id" : "mdBackboneForceFar"
            }
        },
        "var":{
            "T": {
                "val":20, 
                "id" :"mdT"
            },
            "steps" : {
                "val":1000000, 
                "id" :"mdSteps"
            },
            "salt_concentration" : {
                "val":1, 
                "id" :"mdSalt"
            },
            "interaction_type" : {
                "val":"DNA2", 
                "id" :"mdInteractionType"
            },
            "print_conf_interval" : {
                "val":50000,
                "id" :"mdPrintConfInterval"
            },
            "print_energy_every" : {
                "val":50000, 
                "id" :"mdPrintEnergyInterval"
            },
            "thermostat" : {
                "val":"john", 
                "id" :"mdThermostat"
            },
            "dt" : {
                "val":0.005, 
                "id" :"mdDT"
            },
            "diff_coeff" : {
                "val":2.5, 
                "id" :"mdDiff_Coeff"
            },
            "max_density_multiplier"   : {
                "val":10,
                "id" : "mdMaxDensityMul"
            }
        }
    }
};
