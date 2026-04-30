#include<iostream>

using namespace std;

int main(){
    
    int numeros;
    int quant = 0;
    double estrela1 = 0;
    double estrela2 = 0;
    double estrela3 = 0; 
    double estrela4 = 0;
    double estrela5 = 0;
    
    cin >>  numeros;
    
    while( numeros != 6){
        if( numeros = 1){
            estrela1++;
        }
        if( numeros = 2){
            estrela2++;
        }
        if( numeros = 3){
            estrela3++;
        }
        if( numeros = 4){
            estrela4++;
        }
        if( numeros = 5){
            estrela5++;
        }
        cin >> numeros;
        quant++;
    }
    
    cout << estrela1;
    cout << estrela2;
    cout << estrela3;
    cout << estrela4;
    cout << estrela5;
    
    
    
    return 0;
}