var input_file ={
    "MC":{
        "const":{
            "sim_type"               : {"val":"MC"},
            "backend"                : {"val":"CPU"},
            "ensemble"               : {"val":"NVT"},
            "verlet_skin"            : {"val":1.0},
            "time_scale"             : {"val":"linear"},
            "restart_step_counter"   : {"val":1},
            "backend_precision"      : {"val":"double"},
            "use_average_seq"        : {"val":0},
            "use_edge"               : {"var":1},
            "edge_n_forces"          : {"var":1},
            "seq_dep_file"           : {"var":"oxDNA2_sequence_dependent_parameters.txt"},    
            "max_backbone_force"     : {"var":5},
            "max_backbone_force_far" : {"var":10}
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
        //"stuff" : {
        //    "debug" : 0,
        //    "cells_auto_optimisation" : true,
        //    
        //    "newtonian_steps" : 103,
        //    "diff_coeff" : 2.50,
        //
        //    "dt" : 0.002,
        //    "thermostat" : "langevin",
        //    "max_density_multiplier" : 10,
        //
        //    "reset_com_momentum" : true,
        //    "refresh_vel" : 1,
        //}
    }
}
