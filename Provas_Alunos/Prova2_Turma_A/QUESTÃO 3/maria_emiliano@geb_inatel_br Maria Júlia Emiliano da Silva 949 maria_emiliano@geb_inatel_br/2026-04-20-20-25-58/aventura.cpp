#include <iostream>

using namespace std;

int main(){
    int quantidade;
    int moedas = 0;
    int cavernas = 0;
    
    while (quantidade != 0){
        cin >> moedas;
        if (moedas >= 0){
            quantidade = moedas + moedas;
            cin >> cavernas;
            if (cavernas >= 0){
                
            }
        } 
        cout << moedas << cavernas << endl;
    }
        return 0;
}