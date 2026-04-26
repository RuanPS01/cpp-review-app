#include <iostream>

using namespace std;

int main(){
    
    int moedas = 0,c10m = 0,M;
    
    do
    {
        cin >> M;
        
        if(M != 0)
        {
            moedas = moedas + M;

            if(M == 10)
            {
                c10m++;
            }
        }
        
    }while(M != 0);
    
    cout << "Total de moedas: " << moedas << endl;
    cout << "Cavernas com 10 moedas: " << c10m << endl;
    
    return 0;
}